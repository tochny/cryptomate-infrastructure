import json
import boto3
from boto3.dynamodb.conditions import Key
import extensions
import logging

############################################
# define the logger
############################################
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)1.1s %(asctime)s %(module)s:%(lineno)d] %(message)s'
)

dynamodb = boto3.resource('dynamodb')
ssm = boto3.client('ssm')
s3 = boto3.client('s3')
ecs = boto3.client('ecs')

def lambda_handler(event, context):
    try:
        ddb = 'CryptoMateTable'
        table = dynamodb.Table(ddb)
        if('Records' in event):
            # Read contract from s3 source
            for item in event['Records']:
                obj_name = item['s3']['object']['key']
                s3_obj = item['s3']['bucket']['name']
                event_name = item['eventName']
                if ('ObjectCreated' in event_name):
                    obj = s3.get_object(
                        Bucket = s3_obj,
                        Key = obj_name
                    )
                    # Check contracts format
                    # Decode contracts
                    user_data = extensions.read_data(obj['Body'].read())
                    uuid = user_data['uuid']
                    contract = {
                        'uuid': user_data['uuid'],
                        'exName': user_data['exName'],
                        'timestamp': user_data['timestamp'],
                        'months': user_data['months'],
                        'source': user_data['source'],
                        'market': user_data['market'],
                        'strat': user_data['strat']
                    }

                    # Get info from parameters
                    logging.info(f"Starting Contract: {uuid} on MainCluster")
                    clientCapacityProvider = ssm.get_parameter(Name='/CryptoMate/ECSClientCapacityProvider')['Parameter']['Value']
                    baseTaskDefinitionArn = ssm.get_parameter(Name='/CryptoMate/ECSClientTask')['Parameter']['Value']
                    serviceName = f'ClientContract_{uuid}'

                    # Modified base task definition
                    baseTaskDefinition = ecs.describe_task_definition(taskDefinition = baseTaskDefinitionArn)['taskDefinition']
                    logging.info(baseTaskDefinition)
                    baseTaskDefinition['containerDefinitions'][0]['environment'] = [
                        { 'name': 'BUCKET_NAME', 'value': s3_obj},
                        { 'name': 'FILE_NAME', 'value': obj_name},
                        { 'name': 'OBJECT_NAME', 'value': obj_name}
                    ]

                    clientTaskDefinition = ecs.register_task_definition(
                        family = serviceName,
                        taskRoleArn = baseTaskDefinition['taskRoleArn'],
                        executionRoleArn = baseTaskDefinition['executionRoleArn'],
                        networkMode = baseTaskDefinition['networkMode'],
                        containerDefinitions = baseTaskDefinition['containerDefinitions'],
                        requiresCompatibilities = baseTaskDefinition['compatibilities'],
                    )

                    # Create ECS Service
                    contractService = ecs.create_service(
                        cluster = 'MainCluster',
                        serviceName = serviceName,
                        taskDefinition = clientTaskDefinition['taskDefinition']['taskDefinitionArn'],
                        capacityProviderStrategy = [{
                            'capacityProvider': clientCapacityProvider,
                            'weight': 1,
                            'base': 1
                        }],
                        # networkConfiguration = {
                        #     'awsvpcConfiguration': {
                        #         'subnets': privateSubnets.split(','),
                        #         'securityGroups': [ securityGroupId ]
                        #     }
                        # },
                        schedulingStrategy = 'REPLICA',
                        desiredCount = 1,
                        placementStrategy = [{
                            'field': 'attribute:ecs.availability-zone',
                            'type': 'spread'
                        },{
                            'field': 'memory',
                            'type': 'binpack'
                        }],
                        tags = [
                            { 'key': 'BUCKET_NAME', 'value': s3_obj},
                            { 'key': 'FILE_NAME', 'value': obj_name},
                            { 'key': 'OBJECT_NAME', 'value': obj_name}
                        ]
                    )
                    logging.info(f"Service: {contractService}")

                    response = table.update_item(
                        Key={
                            'pKey': "INFO",
                            'sKey': obj_name.split('.')[0]
                        },
                        UpdateExpression="set #name=:name, nickName=:nickName, contract=:contract, serviceName=:serviceName",
                        ExpressionAttributeNames = { "#name": "name" },
                        ExpressionAttributeValues={
                            ':name': user_data['name'],
                            ':nickName': user_data['nickName'],
                            ':contract': contract,
                            ':serviceName': serviceName
                        },
                        ReturnValues="UPDATED_NEW"
                    )
                    logging.info(f"DynamoDb: {response}")

                elif ('ObjectRemoved' in event_name):
                    # Kill service
                    serviceName = table.get_item(Key={'pKey': 'INFO', 'sKey': obj_name.split('.')[0]})['Item']['serviceName']
                    logging.info(f"Attempting to delete contract: {serviceName}")

                    response = ecs.delete_service(
                        cluster='MainCluster',
                        service=serviceName,
                        force=True
                    )

                    logging.info(f"Service: {response}")
                    # Remove table
                    response = table.delete_item(Key={'pKey': 'INFO', 'sKey': obj_name.split('.')[0]})
                    logging.info(f"DynamoDb: {response}")

        return {
            'statusCode': 200,
            'body': json.dumps('Hello from Lambda!')
        }
    except Exception as e:
        logging.exception(e)
