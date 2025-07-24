from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import OrderLineItem


@receiver(post_save, sender=OrderLineItem)
# use the receiver decorator. Telling it we're receiving post saved signals. From the OrderLineItem model.
def update_on_save(sender, instance, created, **kwargs): 
    # So these parameters refer to the sender of the signal. In our case OrderLineItem. 
    # The actual instance of the model that sent it. 
    # A boolean sent by django referring to whether this is a new instance or one being updated. 
    # And any keyword arguments.
    """
    Update order total on lineitem update/create
    """
    instance.order.update_total()


@receiver(post_delete, sender=OrderLineItem)
def update_on_delete(sender, instance, **kwargs):
    # chris made a mistake here, this function should have 
    # been called update_on_delete. He fixes this in an upcoming video.
    """
    Update order total on lineitem delete
    """
    instance.order.update_total()
