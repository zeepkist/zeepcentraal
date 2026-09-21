FROM steamcmd/steamcmd:ubuntu-22@sha256:ea800a0a8468683b51f0f55b6d6e9f2dcaef2ef4a22145e66ac856b28e7deb32

ARG SERVICE_VERSION=dev

LABEL org.opencontainers.image.description="ZeepCentraal one-shot level contest inspector with SteamCMD."

WORKDIR /app

COPY --chmod=755 dist/zeepcentraal-inspector-zeep zeepcentraal-inspector-zeep

ENV NODE_ENV=production
ENV OPENTELEMETRY_SERVICE_NAME=zeepcentraal-inspector-zeep
ENV OPENTELEMETRY_SERVICE_VERSION=$SERVICE_VERSION
ENV STEAMCMD_PATH=/usr/bin/steamcmd

ENTRYPOINT ["/app/zeepcentraal-inspector-zeep"]
