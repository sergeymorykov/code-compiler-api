# GCC image for sandboxed compile+run. Non-root user, minimal surface.
FROM gcc:13-bookworm

# timeout(1) is provided by coreutils in Debian (no package named "timeout")
RUN apt-get update && apt-get install -y --no-install-recommends \
    coreutils \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for container (matches HostConfig.User 1000:1000)
RUN groupadd -g 1000 runuser && useradd -u 1000 -g runuser -m -s /bin/sh runuser

WORKDIR /workspace
RUN chown runuser:runuser /workspace

USER runuser
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'Use exec to run compile/run'"]
