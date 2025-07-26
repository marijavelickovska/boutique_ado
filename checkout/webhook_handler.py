from django.http import HttpResponse

from .models import Order, OrderLineItem
from products.models import Product

import stripe
import json
import time


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
        intent = event.data.object  # webhook praka even.data.object
        print(intent)

        # za da mi raboti print(intent), treba da imam dva terminali, edniot normalno python,
        # a drugiot stripe za se ova da raboti, 
        # komandata za stripe vo terminal : stripe listen --forward-to localhost:8000/checkout/wh/

        pid = intent.id
        bag = intent.metadata.bag
        save_info = intent.metadata.save_info

        # Get the Charge object
        stripe_charge = stripe.Charge.retrieve(
            intent.latest_charge
        )

        billing_details = stripe_charge.billing_details # updated
        shipping_details = intent.shipping
        grand_total = round(stripe_charge.amount / 100, 2) # updated

        # Clean data in the shipping details
        for field, value in shipping_details.address.items():
            if value == "":
                shipping_details.address[field] = None

        order_exists = False
        attempt = 1
        while attempt <= 5:
            try:
                order = Order.objects.get(
                    full_name__iexact=shipping_details.name,
                    email__iexact=billing_details.email,
                    phone_number__iexact=shipping_details.phone,
                    country__iexact=shipping_details.address.country,
                    postcode__iexact=shipping_details.address.postal_code,
                    town_or_city__iexact=shipping_details.address.city,
                    street_address1__iexact=shipping_details.address.line1,
                    street_address2__iexact=shipping_details.address.line2,
                    county__iexact=shipping_details.address.state,
                    grand_total=grand_total,
                    original_bag=bag,
                    stripe_pid=pid,
                )
                order_exists = True
                break
            except Order.DoesNotExist:
                attempt += 1
                time.sleep(1)
        if order_exists:
            return HttpResponse(
                content=f'Webhook received: {event["type"]} | SUCCESS: Verified order already in database',
                status=200)
        else:
            order = None
            try:
                order = Order.objects.create(
                    full_name=shipping_details.name,
                    email=billing_details.email,
                    phone_number=shipping_details.phone,
                    country=shipping_details.address.country,
                    postcode=shipping_details.address.postal_code,
                    town_or_city=shipping_details.address.city,
                    street_address1=shipping_details.address.line1,
                    street_address2=shipping_details.address.line2,
                    county=shipping_details.address.state,
                    grand_total=grand_total,
                    original_bag=bag,
                    stripe_pid=pid,
                )
                for item_id, item_data in json.loads(bag).items():  # isto kako koga gi zimavme od session, razlikata e sto tuka gi zimame od JSON version in the payment intent instead of from the session 
                    product = Product.objects.get(id=item_id)
                    if isinstance(item_data, int):
                        order_line_item = OrderLineItem(
                            order=order,
                            product=product,
                            quantity=item_data,
                        )
                        order_line_item.save()
                    else:
                        for size, quantity in item_data['items_by_size'].items():
                            order_line_item = OrderLineItem(
                                order=order,
                                product=product,
                                quantity=quantity,
                                product_size=size,
                            )
                            order_line_item.save()
            except Exception as e:
                if order:
                    order.delete()
                return HttpResponse(
                    content=f'Webhook received: {event["type"]} | ERROR: {e}',
                    status=500)
        
        return HttpResponse(
            content=f'Webhook received: {event["type"]} | SUCCESS: Created order in webhook',
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




# Changes to the Stripe webhook handler
# After a Stripe update, the charges attribute is no longer available directly from the payment intent.
# Но, intent е Stripe PaymentIntent објект, и тој не секогаш содржи charges поле, 
# освен ако експлицитно не го побараш преку Stripe API со .retrieve() и expand=['charges'].
# To get the billing_details, you will need to:

# 1. Import the Stripe library at the top of the webhook_handler.py file: import stripe
# 2. Update the payment_intent_succeeded method within the StripeWH_Handler class in webhook_handler.py:

# stariot kod bese vaka:
# billing_details = intent.charges.data[0].billing_details
# shipping_details = intent.shipping
# grand_total = round(intent.data.charges[0].amount / 100, 2)

# a noviot kod mi e staven pogore (ova go pisuvam samo zaradi da ne imam nekoj problem dodeka go pravam PP5)