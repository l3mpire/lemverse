FROM geoffreybooth/meteor-base:2.3.6 AS builder

# Copy app package.json and package-lock.json into container
COPY ./app/package*.json $APP_SOURCE_FOLDER/

RUN bash $SCRIPTS_FOLDER/build-app-npm-dependencies.sh

# Copy app source into container
COPY ./app $APP_SOURCE_FOLDER/

RUN bash $SCRIPTS_FOLDER/build-meteor-bundle.sh

# Use the specific version of Node expected by your Meteor release, per https://docs.meteor.com/changelog.html; this is expected for Meteor 2.3.6
FROM node:14.17.6-alpine

LABEL description="Lemverse docker image"
LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.name="l3mpire/lemverse"
LABEL org.label-schema.description="Lemverse docker image"
LABEL org.label-schema.url="https://lemverse.com/"
LABEL org.label-schema.vcs-url="https://github.com/l3mpire/lemverse"
LABEL org.label-schema.vcs-ref=$VCS_REF
LABEL org.label-schema.version="0.0.0"
LABEL org.label-schema.docker.cmd="docker run -v lemverse:/var/tmp/lemverse -p 9000:9000 -d l3mpire/lemverse"

ENV APP_BUNDLE_FOLDER /opt/bundle
ENV SCRIPTS_FOLDER /docker

# Runtime dependencies; if your dependencies need compilation (native modules such as bcrypt) or you are using Meteor <1.8.1, use app-with-native-dependencies.dockerfile instead
RUN apk --no-cache add \
		bash \
		ca-certificates \
        imagemagick \
        graphicsmagick

# Copy in entrypoint
COPY --from=builder $SCRIPTS_FOLDER $SCRIPTS_FOLDER/

# Copy in app bundle
COPY --from=builder $APP_BUNDLE_FOLDER/bundle $APP_BUNDLE_FOLDER/bundle/

RUN bash $SCRIPTS_FOLDER/build-meteor-npm-dependencies.sh

# Start app
ENTRYPOINT ["/docker/entrypoint.sh"]

CMD ["node", "main.js"]