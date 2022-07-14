FROM geoffreybooth/meteor-base:2.7.3 AS builder

# Copy app package.json and package-lock.json into container
COPY ./app/package*.json $APP_SOURCE_FOLDER/

RUN bash $SCRIPTS_FOLDER/build-app-npm-dependencies.sh

# Copy app source into container
COPY ./app $APP_SOURCE_FOLDER/
COPY ./core $APP_SOURCE_FOLDER/core/

RUN bash $SCRIPTS_FOLDER/build-meteor-bundle.sh

# Use the specific version of Node expected by your Meteor release, per https://docs.meteor.com/changelog.html; this is expected for Meteor 2.5
FROM node:14.19.3-alpine

ENV APP_BUNDLE_FOLDER /opt/bundle
ENV SCRIPTS_FOLDER /docker

# Runtime dependencies; if your dependencies need compilation (native modules such as bcrypt) or you are using Meteor <1.8.1, use app-with-native-dependencies.dockerfile instead
RUN apk --no-cache add \
		bash \
		ca-certificates \
        graphicsmagick \
        python3 make g++

# Copy in entrypoint
COPY --from=builder $SCRIPTS_FOLDER $SCRIPTS_FOLDER/

# Copy in app bundle
COPY --from=builder $APP_BUNDLE_FOLDER/bundle $APP_BUNDLE_FOLDER/bundle/

RUN bash $SCRIPTS_FOLDER/build-meteor-npm-dependencies.sh

# Start app
ENTRYPOINT ["/docker/entrypoint.sh"]

CMD ["node", "main.js"]
