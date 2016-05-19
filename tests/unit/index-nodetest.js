/* jshint node: true */
/* jshint mocha: true */
'use strict';
var assert = require('ember-cli/tests/helpers/assert');
var Promise    = require('ember-cli/lib/ext/promise');

describe('ssh-upload plugin', function() {
  var subject, mockUi, context;

  before(function() {
    subject = require('../../index');
  });

  beforeEach(function() {
    mockUi = {
      verbose: true,
      messages: [],
      write: function() {},
      writeLine: function(message) {
        this.messages.push(message);
      }
    };

    context = {
      ui: mockUi,
      distDir: process.cwd() + '/tests/fixtures/dist',
      distFiles: ['favicon.ico', 'manifest.json', 'sw.js', '.htaccess', 'assets/test.js'],
      uploadClient: {
        upload: function(/*options*/) {
          return Promise.resolve(['favicon.ico', 'manifest.json', 'sw.js', '.htaccess']);
        }
      },
      config: {
        'ssh-upload': {
          host: 'aaaa',
          username: 'bbbb',
          remoteDir: 'cccc/',
          filePattern: '{.htaccess,*.{js,ico,json}}',
          distDir: function(context) {
            return context.distDir;
          },
          distFiles: function(context) {
            return context.distFiles || [];
          },
          uploadClient: function(context) {
            return context.uploadClient; // if you want to provide your own upload client to be used instead of one from this addon
          },
          sshClient: function(context) {
            return context.sshClient; // if you want to provide your own s3 client to be used instead of one from aws-sdk
          }
        }
      }
    };
  });

  it('has a name', function() {
    var plugin = subject.createDeployPlugin({
      name: 'ssh-upload',
    });

    assert.equal(plugin.name, 'ssh-upload');
  });

  it('implements the correct hooks', function() {
    var plugin = subject.createDeployPlugin({
      name: 'ssh-upload'
    });

    assert.typeOf(plugin.configure, 'function');
    assert.typeOf(plugin.upload, 'function');
  });

  describe('configure hook', function() {
    it('does not throw if config is ok', function() {
      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });
      plugin.beforeHook(context);
      plugin.configure(context);
      assert.ok(true); // it didn't throw
    });

    it('throws if config is not valid', function() {
      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });

      context.config['ssh-upload'] = {};

      plugin.beforeHook(context);
      assert.throws(function(){
        plugin.configure(context);
      });
    });

    it('warns about missing optional config', function() {
      delete context.config['ssh-upload'].filePattern;
      delete context.config['ssh-upload'].distDir;
      delete context.config['ssh-upload'].distFiles;
      delete context.config['ssh-upload'].uploadClient;
      delete context.config['ssh-upload'].sshClient;

      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });
      plugin.beforeHook(context);
      plugin.configure(context);
      var messages = mockUi.messages.reduce(function(previous, current) {
        if (/- Missing config:\s.*, using default:\s/.test(current)) {
          previous.push(current);
        }

        return previous;
      }, []);

      assert.equal(messages.length, 5);
    });

    describe('required config', function() {
      it('warns about missing host', function() {
        delete context.config['ssh-upload'].host;

        var plugin = subject.createDeployPlugin({
          name: 'ssh-upload'
        });
        plugin.beforeHook(context);
        assert.throws(function(/*error*/){
          plugin.configure(context);
        });
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing required config: `host`/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });

      it('warns about missing username', function() {
        delete context.config['ssh-upload'].username;

        var plugin = subject.createDeployPlugin({
          name: 'ssh-upload'
        });
        plugin.beforeHook(context);
        assert.throws(function(/*error*/){
          plugin.configure(context);
        });
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing required config: `username`/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });

      it('warns about missing remoteDir', function() {
        delete context.config['ssh-upload'].remoteDir;

        var plugin = subject.createDeployPlugin({
          name: 'ssh-upload'
        });
        plugin.beforeHook(context);
        assert.throws(function(/*error*/){
          plugin.configure(context);
        });
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing required config: `remoteDir`/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);

        assert.equal(messages.length, 1);
      });
    });

    it('adds default config to the config object', function() {
      delete context.config['ssh-upload'].filePattern;

      assert.isUndefined(context.config['ssh-upload'].filePattern);

      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });
      plugin.beforeHook(context);
      plugin.configure(context);

      assert.equal(context.config['ssh-upload'].filePattern, '{.htaccess,*.{js,css,png,gif,ico,jpg,map,json,xml,txt,svg}}');
    });
  });

  describe('upload hook', function() {
    it('prints the begin message', function() {
      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.upload(context))
        .then(function() {
          assert.equal(mockUi.messages.length, 2);
          assert.match(mockUi.messages[0], /preparing to upload to SSH host `aaaa`/);
        });
    });

    it('prints success message when files successully uploaded', function() {
      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });

      plugin.beforeHook(context);
      return assert.isFulfilled(plugin.upload(context))
        .then(function() {
          assert.equal(mockUi.messages.length, 2);

          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- uploaded 4 files ok/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);

          assert.equal(messages.length, 1);
        });
    });

    it('prints an error message if the upload errors', function() {
      var plugin = subject.createDeployPlugin({
        name: 'ssh-upload'
      });

      context.uploadClient = {
        upload: function(/*opts*/) {
          return Promise.reject(new Error('something bad went wrong'));
        }
      };

      plugin.beforeHook(context);
      return assert.isRejected(plugin.upload(context))
        .then(function() {
          assert.equal(mockUi.messages.length, 3);
          assert.match(mockUi.messages[1], /- Error: something bad went wrong/);
        });
    });
  });
});
