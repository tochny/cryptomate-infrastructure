from enum import Enum
from datetime import datetime

class ExchangeName(Enum):
    Binance=0
    FTX=1
    Bybit=2
    CoinEx=3

def readInt32(origin):
    data = origin[0:3]
    num = int.from_bytes(data, byteorder='little')

    return num, origin[4:]

def readInt64(origin):
    data = origin[0:7]
    num = int.from_bytes(data, byteorder='little', signed=True)

    return num, origin[8:]

def readStringWithLength(origin):
    length, newData = readInt32(origin)
    ret = ''
    for i in range(length):
        ret += chr(newData[i*2]+newData[1+i*2]*256)
    return ret, newData[2*length:]

def readDecimal(origin):
    num = origin[0:15]
    return num, origin[16:]

def read_data(data):
    year, nextData = readInt32(data)
    month, nextData = readInt32(nextData)
    day, nextData = readInt32(nextData)
    hour, nextData = readInt32(nextData)
    minute, nextData = readInt32(nextData)
    second, nextData = readInt32(nextData)
    millisecond, nextData = readInt32(nextData)
    exName, nextData = readInt32(nextData)
    name, nextData = readStringWithLength(nextData)
    nickName, nextData = readStringWithLength(nextData)
    apiKey, nextData = readStringWithLength(nextData)
    apiSecretKey, nextData = readStringWithLength(nextData)
    usdt, nextData = readDecimal(nextData)
    months, nextData = readInt32(nextData)
    source, nextData = readStringWithLength(nextData)
    market, nextData = readStringWithLength(nextData)
    strat, nextData = readStringWithLength(nextData)
    amtDigits, nextData = readInt32(nextData)
    priceDigits, nextData = readInt32(nextData)
    date = datetime(year, month, day, hour, minute, second, millisecond*1000)
    return {
        'uuid': f'{ExchangeName(exName).name}-{nickName}_{date.strftime("%Y%m%d%H%M%S%f")[:-3]}{apiKey}',
        'timestamp': int(date.timestamp()),
        'exName': ExchangeName(exName).name,
        'name': name,
        'nickName': nickName,
        'months': months,
        'source': source,
        'market': market,
        'strat': strat,
    }

# with open('data.bin', 'rb') as f:
#     data = f.read()

def read_data_pcontract(data):
    ID, nextData = readStringWithLength(data)
    AwsApiPath, nextData = readStringWithLength(nextData)
    TgName, nextData = readStringWithLength(nextData)
    TgDebugChatId, nextData = readInt64(nextData)
    TgMainChatId, nextData = readInt64(nextData)
    IndicatorName, nextData = readStringWithLength(nextData)
    ApiExchange, nextData = readInt32(nextData)
    ApiName, nextData = readStringWithLength(nextData)
    ApiNickname, nextData = readStringWithLength(nextData)
    ApiKey, nextData = readStringWithLength(nextData)
    ApiSecretKey, nextData = readStringWithLength(nextData)
    ApiParams, nextData = readInt32(nextData)
    Market, nextData = readStringWithLength(nextData)
    AmtDigits, nextData = readInt32(nextData)
    PriceDigits, nextData = readInt32(nextData)

    # date = datetime(year, month, day, hour, minute, second, millisecond*1000)
    return {
        'uuid': f'{ApiKey}-{ID}',
        # 'timestamp': int(date.timestamp()),
        'AwsApiPath': AwsApiPath,
        'TgName': TgName,
        'TgDebugChatId': TgDebugChatId,
        'TgMainChatId': TgMainChatId,
        'IndicatorName': IndicatorName,
        'ApiExchange': ApiExchange,
        'ApiName': ApiName,
        'ApiNickname': ApiNickname,
        # 'ApiKey': ApiKey,
        'ApiSecretKey': ApiSecretKey,
        'ApiParams': ApiParams,
        'Market': Market,
        'AmtDigits': AmtDigits,
        'PriceDigits': PriceDigits
    }
