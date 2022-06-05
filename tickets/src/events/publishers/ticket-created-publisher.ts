import { Publisher, Subjects, TicketCreatedEvent } from '@armitickets/common';

export class TicketCreatedPublisher extends Publisher<TicketCreatedEvent> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated; //Remember both so we are not allowed to change it later
}

//Allows to create a new instance of this passing nats and publishing the event
//new TicketCreatedPublisher(stan).publish(ticket);
