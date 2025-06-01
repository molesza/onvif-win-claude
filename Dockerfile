FROM node:22-alpine

# Install DHCP client (dhcpcd is available in Alpine)
RUN apk add --no-cache dhcpcd

ADD ./src /app/src
ADD ./wsdl /app/wsdl
ADD ./resources /app/resources
ADD ./main.js /app/main.js
ADD ./package.json /app/package.json

WORKDIR /app
RUN npm install

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo '# Start without DHCP for now - macvlan will handle networking' >> /app/start.sh && \
    echo 'node main.js /onvif.yaml' >> /app/start.sh && \
    chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
