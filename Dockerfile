# FROM nvidia/cuda
# FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-training:2.3.0-gpu-py37-cu102-ubuntu18.04
FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-training:2.7.0-gpu-py38-cu112-ubuntu20.04-e3
# first layers should be dependency install so changes in code won't cause the build to
# start from scratch.

COPY ./phoenix /opt/program/

RUN chmod 777 /opt/program/*

RUN apt-get -y update && apt-get install -y --no-install-recommends \
         wget \
         uuid-runtime \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/program:${PATH}"

WORKDIR /opt/program

CMD start.sh