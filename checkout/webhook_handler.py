from django.http import HttpResponse


class StripeWH_Handler:
    """Handle Stripe webhooks"""

    def __init__(self, request):
        self.request = request

    def handle_event(self, event):
        """
        Handle a generic/unknown/unexpected webhook event
        """
        return HttpResponse(
            content=f'Unhandled webhook received: {event["type"]}',
            status=200)
    
    def handle_payment_intent_succeeded(self, event):
        """
        Handle the payment_intent.succeeded webhook from Stripe
        """
        intent = event.data.object
        print(intent)

        # za da mi raboti print(intent), treba da imam dva terminali, edniot normalno python,
        # a drugiot stripe za se ova da raboti, 
        # komandata za strime vo terminal : stripe listen --forward-to localhost:8000/checkout/wh/

        return HttpResponse(
            content=f'Webhook received: {event["type"]}',
            status=200)
    
    def handle_payment_intent_payment_failed(self, event):
        """
        Handle the payment_intent.payment_failed webhook from Stripe
        """
        return HttpResponse(
            content=f'Webhook received: {event["type"]}',
            status=200)
    
# Anyway with all this finished let's head to the webhook Handler and 
# print out the payment intent coming from stripe once the user makes a payment. 
# With any luck it should have our metadata attached.
# The payment intent will be saved in a key called event.data.object
# So we'll store that and print it out. Now let's go submit an order and see if it all works.
# As you can see in the terminal now, here is our modified payment intent with the billing information attached,
# as well as our metadata and, of course, the shipping information.
# We're now passing information from our custom form to stripe securely via the payment intent.
# And recapturing it in the webhook so we can use it to add the order to our database.