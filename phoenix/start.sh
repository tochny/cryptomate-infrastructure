#!/bin/bash
export WORKER=$(uuidgen)

echo Worker: \[$WORKER\] starts time: $(date)
echo On Wallet: \[$WALLET\]

echo "./PhoenixMiner -pool eth.gpumine.org:3333 -wal %WALLET% -worker %worker% -coin eth -tstart %tstart% -tstop %tstop% -tt %tt%"
./PhoenixMiner -pool eth.gpumine.org:3333 -wal $WALLET -worker $WORKER -coin eth