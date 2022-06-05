import { Subjects } from './subjects';

//Set coupling between subject and data
//We going to create interfaces for every event to couple everything
export interface TicketCreatedEvent {
  subject: Subjects.TicketCreated;
  data: {
    id: string;
    title: string;
    price: number;
  };
}
