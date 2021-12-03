# Meteor APM (formerly Kadira)

[![APM - Performance Monitoring for Meteor Apps](https://s3.amazonaws.com/dev-apm-screenshots/meteor-apm-agent/README-2.png)](https://www.meteor.com/hosting)

### Getting started

1. Login to your own Meteor APM instance.
2. From the UI, create an app. You'll get an `AppId` and an `AppSecret`.
3. Run `meteor add astraload:meteor-apm-client` inside your Meteor project.
4. Configure your Meteor app with the `AppId`, `AppSecret` and `endpoint` using environment variables or Meteor settings.
5. Install [zodern:standard-minifier-js and zodern:hide-production-sourcemaps](https://atmospherejs.com/zodern/standard-minifier-js) 
Now you can deploy your application and it will send information to your APM. Wait up to one minute and you'll see data appearing in the Dashboard.


### How-To Connect

Your app can connect to Meteor APM using environment variables or using [`Meteor.settings`](http://docs.meteor.com/#meteor_settings).

#### Using Meteor.settings
Use the followng `settings.json` file with your app:

```js
{
  ...
  "kadira": {
    "appId": "<appId>",
    "appSecret": "<appSecret>",
    "options": {
      "endpoint": "https://<MY-APM-DOMAIN>:<PORT>",
      "webClientEndpoint": "https://<MY-APM-DOMAIN>:<PORT>"
      "sourceMap": "true"
    }
  }
  ...
}
```

You should set hash to identify source-map version
```
export COMMIT_HASH='<commitHash>'
```

The run your app with `meteor --settings=settings.json`.

#### Using Environment Variables

Export the following environment variables before running or deploying your app:

```
export KADIRA_APP_ID=<appId>
export KADIRA_APP_SECRET=<appSecret>
````

### Error Tracking

APM comes with built in error tracking solution for Meteor apps. It has been enabled by default.
'webClientEndpoint' option lets you set different endpoints for server and web clients. 

### More information

Check out the [Meteor APM Guide](http://galaxy-guide.meteor.com/apm-getting-started.html) for more information and improve your app with Meteor APM.
