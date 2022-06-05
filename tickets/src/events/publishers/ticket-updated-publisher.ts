import { Publisher, Subjects, TicketUpdatedEvent } from '@armitickets/common';

export class TicketUpdatedPublisher extends Publisher<TicketUpdatedEvent> {
  subject: Subjects.TicketUpdated = Subjects.TicketUpdated; //Remember both so we are not allowed to change it later
}

//Allows to create a new instance of this passing nats and publishing the event
//new TicketCreatedPublisher(stan).publish(ticket);
