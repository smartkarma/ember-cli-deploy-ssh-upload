/* jshint node: true */
/* jshint mocha: true */
'use strict';
var assert = require('ember-cli/tests/helpers/assert');

describe('ssh adapter', function() {
  var SSHAdapter, mockUi, sshClient, sftpClient, writeStreamFactory, plugin, subject;

  before(function() {
    SSHAdapter = require('../../../lib/ssh-adapter');
  });

  beforeEach(function() {
    sshClient = {
      listeners: [],
      on: function(event, cb) {
        this.listeners.push({event: event, callback: cb});
        return this;
      },
      trigger: function(event, params) {
        this.listeners.forEach(function(listener) {
          if (listener.event === event) {
            listener.callback(params);
          }
        });
        return this;
      },
      connect: function(/*options*/) {
        return this.trigger('ready');
      },
      sftp: function(cb) {
        cb(undefined, sftpClient);
      }
    };
    sftpClient = {
      createWriteStream: function(fileName) {
        return writeStreamFactory.create(fileName);
      }
    };
    writeStreamFactory = {
      create: function(fileName) {
        return {
          fileName: fileName,
          listeners: [],
          on: function(event, cb) {
            this.listeners.push({event: event, callback: cb});
            return this;
          },
          trigger: function(event, params) {
            this.listeners.forEach(function(listener) {
              if (listener.event === event) {
                listener.callback(params);
              }
            });
            return this;
          },
          write: function() {
            return this;
          },
          end: function() {
            this.trigger('finish');
            return this;
          }
        };
      }
    };
    mockUi = {
      messages: [],
      write: function() {},
      writeLine: function(message) {
        this.messages.push(message);
      }
    };
    plugin = {
      ui: mockUi,
      readConfig: function(propertyName) {
        if (propertyName === 'sshClient') {
          return sshClient;
        }
      },
      log: function(message/*, opts*/) {
        this.ui.write('|    ');
        this.ui.writeLine('- ' + message);
      }
    };
    subject = new SSHAdapter({
      plugin: plugin
    });
  });

  describe('upload', function() {
    it('resolves if all uploads succeed', function() {
      var options = {
        filePaths: ['manifest.json', '.htaccess'],
        remoteDir: 'aaaa/',
        cwd: process.cwd() + '/tests/fixtures/dist',
      };

      var promises = subject.upload(options);

      return assert.isFulfilled(promises)
        .then(function() {
          assert.equal(mockUi.messages.length, 2);

          var messages = mockUi.messages.reduce(function(previous, current) {
            if (/- ✔  aaaa\/(\.htaccess|manifest\.json)/.test(current)) {
              previous.push(current);
            }

            return previous;
          }, []);

          assert.equal(messages.length, 2);
        });
    });
  });
});
