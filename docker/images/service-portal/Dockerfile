FROM node:14-slim

RUN apt-get update

RUN apt-get --yes install bash tree direnv


### Required for running google-chrome/puppeteer inside of container:
##
RUN apt-get install -y wget gnupg
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update
RUN apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends
RUN rm -rf /var/lib/apt/lists/*

# Uncomment to skip the chromium download when installing puppeteer. If you do,
# you'll need to launch puppeteer with:
#     browser.launch({executablePath: 'google-chrome-stable'})
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
##

# copy shell init files for convenience when attaching to containers
COPY docker/shared/root.profile /root/.bashrc

RUN npm i -g lerna rollup

ARG USER_ID
ARG GROUP_ID

RUN echo user/group ${USER_ID} : ${GROUP_ID}

RUN if [ ${USER_ID:-0} -ne 0 ] && [ ${GROUP_ID:-0} -ne 0 ]; then \
    if getent group run-user ; then groupdel run-user; fi &&\
    groupadd -g ${GROUP_ID} run-user &&\
    useradd -l -u ${USER_ID} -g run-user run-user &&\
    install -d -m 0755 -o run-user -g run-user /home/run-user &&\
    chown --changes --silent --no-dereference -R ${USER_ID}:${GROUP_ID} /home/run-user \
;fi
        
USER run-user

WORKDIR /usr/src/app/service-portal

COPY --chown=run-user:run-user package*.json ./
COPY --chown=run-user:run-user lerna.json ./lerna.json

COPY --chown=run-user:run-user workspaces/commons ./workspaces/commons
COPY --chown=run-user:run-user docker/shared/dot.envrc ./workspaces/commons/.envrc
RUN direnv allow ./workspaces/commons

COPY --chown=run-user:run-user workspaces/services ./workspaces/services
COPY --chown=run-user:run-user docker/shared/dot.envrc ./workspaces/services/.envrc

RUN direnv allow ./workspaces/services

RUN lerna bootstrap

WORKDIR /usr/src/app/service-portal/workspaces/commons

RUN rollup -c

WORKDIR /usr/src/app/service-portal/workspaces/services

RUN rollup -c

WORKDIR /usr/src/app/service-portal/workspaces/services

USER root
RUN chown -R run-user /usr/src/app/service-portal
USER run-user

# RUN whoami && pwd && ls -thaFl . && ls -thaFl .. &&  ls -thaFl ../..

ENTRYPOINT ["node", "./dist/bundle.js"]
