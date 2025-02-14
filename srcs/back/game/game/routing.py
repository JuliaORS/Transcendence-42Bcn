from django.urls import re_path
from ping_pong.consumers import PongConsumer

websocket_urlpatterns = [
    re_path(r"ws/(?P<type>[TG])/(?P<tgID>\d+)(?:/(?P<gID>\d+))?/$", PongConsumer.as_asgi()),
]

'''
ws/ -> websocket prefix
(?P<arg1>[TG]) -> captures argument #1 and names it type. It can either be T or G
/(?P<arg2>\d+) -> captures argument #2 and names it tgID. It must contain digits (1 or more)
(?:/[...])? -> optional argument
/(?P<arg3>\d+) -> captures argument #3 and names it gID. It must contain digits (1 or more)
/$ -> end of endpoint
'''
