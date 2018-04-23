/* jshint node: true */
'use strict';

var RSVP = require('rsvp');
var minimatch = require('minimatch');
var DeployPluginBase = require('ember-cli-deploy-plugin');
var SSHAdapter = require('./lib/ssh-adapter');

module.exports = {
  name: 'ember-cli-deploy-ssh-upload',

  createDeployPlugin: function(options) {
    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        filePattern:
          '{.htaccess,*.{js,css,png,gif,ico,jpg,map,json,xml,txt,svg}}',
        distDir: function(context) {
          return context.distDir;
        },
        distFiles: function(context) {
          return context.distFiles || [];
        },
        uploadClient: function(context) {
          return context.uploadClient; // if you want to provide your own upload client to be used instead of one from this plugin
        },
        sshClient: function(context) {
          return context.sshClient; // if you want to provide your own SSH client to be used instead of one from this plugin
        }
      },

      requiredConfig: ['host', 'username', 'remoteDir'],

      upload: function(/*context*/) {
        var self = this;
        var filePattern = this.readConfig('filePattern');
        var distFiles = this.readConfig('distFiles');
        var host = this.readConfig('host');

        var filesToUpload = distFiles.filter(minimatch.filter(filePattern));

        var sshAdapter =
          this.readConfig('uploadClient') ||
          new SSHAdapter({
            plugin: this
          });

        var options = {
          cwd: this.readConfig('distDir'),
          remoteDir: this.readConfig('remoteDir'),
          filePaths: filesToUpload,
          host: host,
          username: this.readConfig('username'),
          password: this.readConfig('password'),
          port: this.readConfig('port'),
          agent: this.readConfig('agent')
        };

        var privateKeyFile = this.readConfig('privateKeyFile');
        if (!!privateKeyFile) {
          options.privateKey = require('fs').readFileSync(privateKeyFile);
        }

        this.log('preparing to upload to SSH host `' + host + '`', {
          verbose: true
        });
        return sshAdapter
          .upload(options)
          .then(function(filesUploaded) {
            self.log('uploaded ' + filesUploaded.length + ' files ok', {
              verbose: true
            });
            return { filesUploaded: filesUploaded };
          })
          .catch(this._errorMessage.bind(this));
      },

      _errorMessage: function(error) {
        this.log(error, { color: 'red' });
        if (error) {
          this.log(error.stack, { color: 'red' });
        }
        return RSVP.reject(error);
      }
    });
    return new DeployPlugin();
  }
};
