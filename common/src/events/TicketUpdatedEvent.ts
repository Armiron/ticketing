import { Subjects } from './Subjects';

export interface TicketUpdatedEvent {
  subject: Subjects.TicketUpdated;
  data: {
    id: string;
    version: number;
    price: number;
    title: string;
    userId: string;
    orderId?: string;
  };
}
