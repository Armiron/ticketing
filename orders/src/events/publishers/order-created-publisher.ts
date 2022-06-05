import { Publisher, OrderCreatedEvent, Subjects } from '@armitickets/common';

export class OrderCreatedPublisher extends Publisher<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;
}

// new OrderCreatedPublisher(natsClient).publish({});
