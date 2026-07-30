const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key]) {
      mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});

app.post('/', (req, res) => res.json(req.body));
const request = require('supertest');
request(app)
  .post('/')
  .send({ a: { $gt: 1 } })
  .expect(200)
  .then(res => console.log('Response:', res.body))
  .catch(err => console.error('Error:', err));
