FROM python:3.8-alpine

WORKDIR /lint

RUN pip install djlint==1.18.0

COPY . /lint

CMD ["./scripts/djlint.sh"]
