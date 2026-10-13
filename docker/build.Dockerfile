# Build/test environment shared by CI, `docker compose`, and the devcontainer.
# Bookworm keeps glibc old enough for the AppImage to run on most distros.
ARG NODE_MAJOR=22

FROM node:${NODE_MAJOR}-bookworm-slim AS node

FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive
ARG USERNAME=builder
ARG USER_UID=1000
ARG USER_GID=1000

# https://v2.tauri.app/start/prerequisites/#linux
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        file \
        git \
        libayatana-appindicator3-dev \
        libgtk-3-dev \
        librsvg2-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        libxdo-dev \
        patchelf \
        pkg-config \
        sudo \
        wget \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    COREPACK_HOME=/usr/local/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_store_dir=/pnpm-store \
    APPIMAGE_EXTRACT_AND_RUN=1 \
    CI=true
ENV PATH=/usr/local/cargo/bin:$PATH

WORKDIR /tmp/toolchain
COPY rust-toolchain.toml package.json ./
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --no-modify-path --profile minimal --default-toolchain none \
    && rustup toolchain install \
    && rustc --version \
    && corepack enable pnpm \
    && corepack install \
    && pnpm --version \
    && groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m -s /bin/bash ${USERNAME} \
    && echo "${USERNAME} ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} \
    && mkdir -p /pnpm-store \
    && chmod -R a+rwX ${RUSTUP_HOME} ${CARGO_HOME} ${COREPACK_HOME} /pnpm-store \
    && rm -rf /tmp/toolchain

WORKDIR /workspace
