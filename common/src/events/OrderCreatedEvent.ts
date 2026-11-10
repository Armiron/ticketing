import { OrderStatus } from './types/OrderStatus';
import { Subjects } from './Subjects';

export interface OrderCreatedEvent {
  subject: Subjects.OrderCreated;
  data: {
    id: string;
    version: number;
    userId: string;
    expiresAt: string;
    status: OrderStatus;
    ticket: {
      id: string;
      price: number;
    };
  };
}
