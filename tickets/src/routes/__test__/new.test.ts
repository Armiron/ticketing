import request from 'supertest';
import { app } from '../../app';
import { Ticket } from '../../models/ticket';
import { natsWrapper } from '../../nats-wrapper';

it('has a route handler listening to /api/tickets for post request', async () => {
  const response = await request(app).post('/api/tickets').send({});
  expect(response.statusCode).not.toEqual(404);
});

it('can only be accesses if user is signed in', async () => {
  const response = await request(app).post('/api/tickets').send({}).expect(401);
  //expect(response.status).toEqual(401);
});

it('returns a status other than 401 if user is signed in', async () => {
  const response = await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({});
  expect(response.status).not.toEqual(401);
});

it('returns an error if an invalid title is provided', async () => {
  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title: '',
      price: 10,
    })
    .expect(400);

  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title: '',
      price: 10,
    })
    .expect(400);
});

it('return an error in an invalid price is provided', async () => {
  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title: 'Title',
      price: -10,
    })
    .expect(400);

  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title: 'Title',
    })
    .expect(400);
});

it('creates a ticket with valid inputs', async () => {
  let tickets = await Ticket.find({});
  expect(tickets.length).toEqual(0);
  const title = 'Title';
  const price = 1;
  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title,
      price,
    })
    .expect(201);

  tickets = await Ticket.find({});
  expect(tickets.length).toEqual(1);
  expect(tickets[0].title).toEqual(title);
  expect(tickets[0].price).toEqual(price);
});

it('publishes an event', async () => {
  const title = 'Title';
  const price = 1;
  await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title,
      price,
    })
    .expect(201);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
