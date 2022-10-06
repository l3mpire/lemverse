FROM node:14

WORKDIR /lint

COPY package*.json ./
RUN npm install --only=dev


COPY . /lint

CMD ["./scripts/eslint.sh"]
