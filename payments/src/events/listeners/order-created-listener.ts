import { Listener, OrderCreatedEvent, Subjects } from '@armitickets/common';
import { Message } from 'node-nats-streaming';
import { Order } from '../../models/order';
import { queueGroupName } from './queue-group-name';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: OrderCreatedEvent['data'], msg: Message) {
    const { id, ticket, status, userId, version } = data;
    const order = Order.build({
      id: id,
      price: ticket.price,
      status: status,
      userId: userId,
      version: version,
    });

    await order.save();

    msg.ack();
  }
}
