// Taken from https://github.com/VeliovGroup/Meteor-Files/blob/master/docs/aws-s3-integration.md
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { Random } from 'meteor/random';
import { FilesCollection } from 'meteor/ostrio:files';
import stream from 'stream';

// IMPORTANT: Import disabled due to missing http2 package from smithy (aws-sdk sub-dependency)
// import { S3Client } from '@aws-sdk/client-s3'; /* http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html */
/* See fs-extra and graceful-fs NPM packages */
/* For better i/o performance */
import fs from 'fs';


import { fileOnBeforeUpload } from './misc';

function fileSystemAdapter() {
  const s3Conf = Meteor.settings.s3;

  if (!s3Conf || !s3Conf.key) {
    // Original FilesCollection
    return new FilesCollection({
      collectionName: 'Files',
      storagePath: Meteor.settings.public.files.storagePath,
      downloadRoute: Meteor.settings.public.files.route,
      public: true,
      allowClientCode: false,
      onBeforeUpload(file) { return fileOnBeforeUpload(file, file.mime); },
    });
  }

  // AWS S3 FileCollection
  const bound = Meteor.bindEnvironment(callback => callback());
  const S3Client = {};
  const s3 = new S3Client({
    secretAccessKey: s3Conf.secret,
    accessKeyId: s3Conf.key,
    region: s3Conf.region,
    sslEnabled: true,
    httpOptions: {
      timeout: 6000,
      agent: false,
    },
  });

  // Check if S3 bucket exists
  s3.headBucket({ Bucket: s3Conf.bucket }, err => {
    if (err) {
      throw new Meteor.Error('s3-bucket-not-found', `S3 bucket "${s3Conf.bucket}" not found`);
    }
  });

  // Declare the Meteor file collection on the Server
  const Files = new FilesCollection({
    collectionName: 'Files',
    storagePath: Meteor.settings.public.files.storagePath,
    downloadRoute: Meteor.settings.public.files.route,
    public: true,
    allowClientCode: false, // Disallow remove files from Client, important
    debug: Meteor.settings.public.debug,

    onBeforeUpload(file) { return fileOnBeforeUpload(file, file.mime); },

    // Start moving files to AWS:S3
    // after fully received by the Meteor server
    onAfterUpload(fileRef) {
      _.each(fileRef.versions, (vRef, version) => {
        const filePath = `files/${Random.id()}-${version}.${fileRef.extension}`;
        s3.putObject({
          // ServerSideEncryption: 'AES256', // Optional
          StorageClass: 'STANDARD',
          Bucket: s3Conf.bucket,
          Key: filePath,
          Body: fs.createReadStream(vRef.path),
          ContentType: vRef.type,
        }, error => {
          bound(() => {
            if (error) {
              throw new Meteor.Error(error);
            }
            // Update FilesCollection with link to the file at AWS
            const update = { $set: {} };
            update.$set[`versions.${version}.meta.pipePath`] = filePath;

            this.collection.update({
              _id: fileRef._id,
            }, update, updateError => {
              if (updateError) {
                throw new Meteor.Error(updateError);
              }
              // Unlink original files from FS after successful upload to AWS:S3
              // Unlink removes the file from the storagePath
              // So we only need a storage of 5mB (onBeforeUpload) for the original files
              this.unlink(this.collection.findOne(fileRef._id), version);
            },
            );
          });
        });
      });
    },

    // Intercept access to the file
    // And redirect request to AWS:S3
    interceptDownload(http, fileRef, version) {
      let path;

      if (fileRef && fileRef.versions && fileRef.versions[version] && fileRef.versions[version].meta && fileRef.versions[version].meta.pipePath) {
        path = fileRef.versions[version].meta.pipePath;
      }

      if (path) {
        if (s3Conf.cdn) {
          const cdnUrl = s3Conf.cdn.url.replace(/\/$/, '');
          const completePath = `${cdnUrl}/${path}`.replace(/\/$/, '');

          http.response.writeHead(307, {
            Location: completePath,
          });

          return false;
        }

        const opts = {
          Bucket: s3Conf.bucket,
          Key: path,
        };

        if (http.request.headers.range) {
          const vRef = fileRef.versions[version];
          const range = _.clone(http.request.headers.range);
          const array = range.split(/bytes=([0-9]*)-([0-9]*)/);
          const start = parseInt(array[1], 10);
          let end = parseInt(array[2], 10);
          if (Number.isNaN(end)) {
            // Request data from AWS:S3 by small chunks
            end = (start + this.chunkSize) - 1;
            if (end >= vRef.size) {
              end = vRef.size - 1;
            }
          }
          opts.Range = `bytes=${start}-${end}`;
          http.request.headers.range = `bytes=${start}-${end}`;
        }

        const fileColl = this;
        s3.getObject(opts, function (error) {
          if (error) {
            if (!http.response.finished) {
              http.response.end();
            }
            throw new Meteor.Error(error);
          } else {
            if (http.request.headers.range && this.httpResponse.headers['content-range']) {
              // Set proper range header in according to what is returned from AWS:S3
              http.request.headers.range = this.httpResponse.headers['content-range'].split('/')[0].replace('bytes ', 'bytes=');
            }

            const dataStream = new stream.PassThrough();
            fileColl.serve(http, fileRef, fileRef.versions[version], version, dataStream);
            dataStream.end(this.data.Body);
          }
        });

        return true;
      }
      // While file is not yet uploaded to AWS:S3
      // It will be served file from FS
      return false;
    },
  });

  // Monkeypatch the remove method to also remove the file from AWS:S3
  // otherwise we would have trailing files on AWS:S3
  const _origRemove = Files.remove;
  Files.remove = function (selector, callback) {
    const cursor = this.collection.find(selector);
    cursor.forEach(fileRef => {
      _.each(fileRef.versions, vRef => {
        if (vRef && vRef.meta && vRef.meta.pipePath) {
          // Remove the object from AWS:S3 first, then we will call the original FilesCollection remove
          s3.deleteObject({
            Bucket: s3Conf.bucket,
            Key: vRef.meta.pipePath,
          }, error => {
            bound(() => {
              if (error) {
                throw new Meteor.Error(error);
              }
            });
          });
        }
      });
    });

    // remove original file from database
    _origRemove.call(this, selector, callback);
  };
  return Files;
}

export default fileSystemAdapter;
