FROM resin/%%BALENA_MACHINE_NAME%%-node

COPY trui-pi/package.json /package.json
RUN npm install

COPY trui-pi/ /usr/src/app
CMD ["node", "/usr/src/app/main.js"]
