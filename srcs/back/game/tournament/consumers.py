# import json
# from channels.generic.websocket import WebsocketConsumer

# class PongConsumer(WebsocketConsumer):
#     def connect(self):
#         self.accept()

#     def disconnect(self, close_code):
#         pass

#     def receive(self, text_data):
#         data = json.loads(text_data)
#         console.log(data)
#         # Here, handle data like paddle position, ball position, etc.
#         # Broadcast the data to the other player
#         self.send(text_data=json.dumps(data))
