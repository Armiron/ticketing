import request from 'supertest';
import { app } from '../../app';
import mongoose from 'mongoose';
import { Ticket } from '../../models/ticket';
import { Order, OrderStatus } from '../../models/order';
import { natsWrapper } from '../../nats-wrapper'; //With this import is already mocked out

it("returns an error if ticket doesn't exist", async () => {
  const ticketId = new mongoose.Types.ObjectId();

  const res = await request(app)
    .post('/api/orders')
    .set(signin())
    .send({
      ticketId,
    })
    .expect(404);
});

it('returns an error if ticket is already reserved', async () => {
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'Title',
    price: 1,
  });
  await ticket.save();

  const order = Order.build({
    ticket,
    userId: 'randomId',
    status: OrderStatus.Created,
    expiresAt: new Date(),
  });

  await order.save();

  await request(app)
    .post('/api/orders')
    .set(signin())
    .send({
      ticketId: ticket.id,
    })
    .expect(400);
});

it('reserves a ticket', async () => {
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'Title',
    price: 1,
  });
  await ticket.save();

  await request(app)
    .post('/api/orders')
    .set(signin())
    .send({
      ticketId: ticket.id,
    })
    .expect(201);
});

it('emits an order created event', async () => {
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'Title',
    price: 1,
  });
  await ticket.save();

  await request(app)
    .post('/api/orders')
    .set(signin())
    .send({
      ticketId: ticket.id,
    })
    .expect(201);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
