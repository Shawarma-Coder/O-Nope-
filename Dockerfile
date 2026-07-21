#ligtwieight linux distro
FROM alpine:latest

# GNU C++ compiler (g++)
RUN apk add --no-cache g++

# Create directory for our work
WORKDIR /sandbox

# setting a non root user to work as in the image   
RUN adduser -D coder
USER coder