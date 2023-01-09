import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudFront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as codePipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as codeBuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudWatch from 'aws-cdk-lib/aws-cloudwatch';
import * as route53 from 'aws-cdk-lib/aws-route53';

import { Stack, StackProps, RemovalPolicy, aws_certificatemanager, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';

export class CryptomateInfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domain = ssm.StringParameter.fromStringParameterName(this, 'Domain', '/Cryptomate/Domain').stringValue;
    const assessmentsDomain = ssm.StringParameter.fromStringParameterName(this, 'Assessments', '/Cryptomate/AssessmentsDomain').stringValue;
    const consoleRepoUrl = ssm.StringParameter.fromStringParameterName(this, 'ConsoleRepoUrl', '/Cryptomate/ConsoleImage').stringValue;
    const tradeWagonRepoUrl = ssm.StringParameter.fromStringParameterName(this, 'TradeWagonRepoUrl', '/Cryptomate/TradeWagonImage').stringValue;
    const clientTestRepoUrl = ssm.StringParameter.fromStringParameterName(this, 'ClientTestRepoUrl', '/Cryptomate/ClientImage').stringValue;



    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ]
    });

    const ecsAPIClientTaskExecutionRole = new iam.Role(this, 'ecsAPIClientTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      // Managed policy for ECS Task Execution Role
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
        // iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        // iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
      inlinePolicies: {
        'client-api-custom-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['kms:Encrypt'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: ['ecr:*'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    const ec2ClientCapacityProviderRole = new iam.Role(this, 'ec2ClientCapacityProviderRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        'contract-custom-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['ecs:ListTagsForResource'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });


    // const siteBucket = new Bucket(this, 'siteBucket', {
    //   bucketName: domain,
    //   websiteIndexDocument: 'index.html',
    //   publicReadAccess: false,
    //   blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   autoDeleteObjects: true,
    // });

    // const manageSiteBucket = new Bucket(this, 'manageSiteBucket', {
    //   bucketName: manageDomain,
    //   websiteIndexDocument: 'index.html',
    //   publicReadAccess: false,
    //   blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   autoDeleteObjects: true,
    // });

    const assessmentsBucket = new Bucket(this, 'assessmentsBucket', {
      bucketName: assessmentsDomain,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const ecsTaskExecutionRole = new iam.Role(this, 'ecsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
      ], // Managed policy for ECS Task Execution Role
      inlinePolicies: {
        'contract-custom-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['ecs:ListTagsForResource'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    const vpc = new ec2.Vpc(this, "EcsVpc", {
      cidr: '10.200.0.0/16',
      natGateways: 0,
      maxAzs: 99,
    });

    const securityGroup = new SecurityGroup(this, 'ECS_SG', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Allow Container Outbound Traffic',
    });
    securityGroup.addIngressRule(securityGroup, ec2.Port.allTraffic());
    securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic());

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: vpc,
      containerInsights: false,
      clusterName: 'MainCluster',
    });

    // const ecrRepoClient = new ecr.Repository(this, 'ecrRepoClient', {
    //   repositoryName: 'cryptomate-client',
    //   imageScanOnPush: true,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    // const ecrRepoServer = new ecr.Repository(this, 'ecrRepoServer', {
    //   repositoryName: 'cryptomate-server',
    //   imageScanOnPush: true,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    // const ecrRepoAPI = new ecr.Repository(this, 'ecrRepoAPI', {
    //   repositoryName: 'cryptomate-api',
    //   imageScanOnPush: true,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM),
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: autoscaling.BlockDeviceVolume.ebs(30, {
          volumeType: autoscaling.EbsDeviceVolumeType.GP3
        }),
      }],
      minCapacity: 0,
      maxCapacity: 10,
      // desiredCapacity: 1,
      securityGroup: securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    const clientAutoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ClientASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM),
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: autoscaling.BlockDeviceVolume.ebs(40, {
          volumeType: autoscaling.EbsDeviceVolumeType.GP3
        }),
      }],
      minCapacity: 0,
      maxCapacity: 100,
      // desiredCapacity: 1,
      securityGroup: securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: ec2ClientCapacityProviderRole,
    });

    const clientCapacityProvider = new ecs.AsgCapacityProvider(this, 'ClientAsgCapacityProvider', {
      autoScalingGroup: clientAutoScalingGroup,
    });
    cluster.addAsgCapacityProvider(clientCapacityProvider);

    const clientTable = new dynamodb.Table(this, 'CryptoMateTable', {
      tableName: 'CryptoMateTable',
      partitionKey: { name: 'pKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.TaskDefinition(this, "ecsTaskDefinition", {
      compatibility: ecs.Compatibility.EC2,
      taskRole: ecsAPIClientTaskExecutionRole,
      executionRole: ecsAPIClientTaskExecutionRole,
      family: "cryptomate-api",
      networkMode: ecs.NetworkMode.HOST,
    });

    const ServerContainer = taskDefinition.addContainer("ServerContainer", {
      image: ecs.ContainerImage.fromRegistry(serverRepoUrl),
      portMappings: [{
        containerPort: 610,
        hostPort: 610
      }],
      memoryReservationMiB: 256,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "server" }),
      environment: {
        DOCKER: "true",
      },
    });

    const apiContainer = taskDefinition.addContainer("ApiContainer", {
      image: ecs.ContainerImage.fromRegistry(apiRepoUrl),
      portMappings: [{
        containerPort: 32768,
        hostPort: 32768
      }],
      memoryReservationMiB: 256,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "api" }),
      environment: {
        DOCKER: "true",
      },
    });

    ServerContainer.addContainerDependencies({
      container: apiContainer,
      condition: ecs.ContainerDependencyCondition.START,
    });

    const clientTaskDefinition = new ecs.TaskDefinition(this, "ecsClientTaskDefinition", {
      compatibility: ecs.Compatibility.EC2,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
      family: "client",
      networkMode: ecs.NetworkMode.HOST,
    });

    const clientContainer = clientTaskDefinition.addContainer("ClientContainer", {
      image: ecs.ContainerImage.fromRegistry(clientRepoUrl),
      memoryReservationMiB: 128,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "client" }),
      environment: {
        DOCKER: "true",
      },
    });

    const clientTestTaskDefinition = new ecs.TaskDefinition(this, "ecsClientTestTaskDefinition", {
      compatibility: ecs.Compatibility.EC2,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
      family: "clientTest",
      networkMode: ecs.NetworkMode.HOST,
    });

    const clientTestContainer = clientTestTaskDefinition.addContainer("ClientTestContainer", {
      image: ecs.ContainerImage.fromRegistry(clientTestRepoUrl),
      memoryReservationMiB: 128,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "clientTest" }),
      environment: {
        DOCKER: "true",
      },
    });

    const tradeWagonTaskDefinition = new ecs.TaskDefinition(this, "ecsTradeWagonTaskDefinition", {
      compatibility: ecs.Compatibility.EC2,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
      family: "tradeWagon",
      networkMode: ecs.NetworkMode.HOST,
    });

    const tradeWagonContainer = tradeWagonTaskDefinition.addContainer("tradeWagonContainer", {
      image: ecs.ContainerImage.fromRegistry(tradeWagonRepoUrl),
      memoryReservationMiB: 128,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "tradeWagon" }),
      environment: {
        DOCKER: "true",
      },
    });

    const consoleTaskDefinition = new ecs.TaskDefinition(this, "ecsConsoleTaskDefinition", {
      compatibility: ecs.Compatibility.EC2,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
      family: "console",
      networkMode: ecs.NetworkMode.HOST,
    });

    const consoleContainer = consoleTaskDefinition.addContainer("consoleContainer", {
      image: ecs.ContainerImage.fromRegistry(consoleRepoUrl),
      memoryReservationMiB: 128,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "console" }),
      environment: {
        DOCKER: "true",
      },
    });

    const loadBalancedEcsService = new ecsPatterns.NetworkLoadBalancedEc2Service(this, 'LoadBalancedEcsService', {
      cluster,
      serviceName: 'MainService',
      listenerPort: 610,
      taskDefinition,
      placementConstraints: [
        ecs.PlacementConstraint.distinctInstances(),
      ],
      domainName: `dev.server.node.${domain}`,
      domainZone: route53.HostedZone.fromLookup(this, 'DomainZone', {
        domainName: domain,
      }),
      healthCheckGracePeriod: Duration.seconds(300),
    });

    (loadBalancedEcsService.targetGroup.node.defaultChild as elbv2.CfnTargetGroup).port = 610;
    // console.log(loadBalancedEcsService.service.node.defaultChild as ecs.CfnService);
    (loadBalancedEcsService.service.node.defaultChild as ecs.CfnService).addPropertyOverride('CapacityProviderStrategy', [{
      base: 1,
      weight: 1,
      capacityProvider: capacityProvider.capacityProviderName,
    }]);
    (loadBalancedEcsService.service.node.defaultChild as ecs.CfnService).addPropertyDeletionOverride('LaunchType');

    const dashboard = new cloudWatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'AutoScalingDashboard'
    });

    const cpuUtilizationMetric = loadBalancedEcsService.service.metricCpuUtilization({
      period: Duration.minutes(1),
      label: 'CPU Utilization'
    });

    const loadBalancerMetric = loadBalancedEcsService.loadBalancer.metricActiveFlowCount({
      period: Duration.minutes(1),
      label: 'Active Flow Count'
    });

    dashboard.addWidgets(
      new cloudWatch.GraphWidget({
        left: [cpuUtilizationMetric],
        width: 12,
        title: 'CPU Utilization'
      })
    );

    dashboard.addWidgets(
      new cloudWatch.GraphWidget({
        left: [loadBalancerMetric],
        width: 12,
        title: 'Active Flow Count'
      })
    );

    // autoScalingGroup.scaleOnMetric('ActiveFlowCount', {
    //   metric: loadBalancerMetric,
    //   scalingSteps: [
    //     {upper: 10, change: 0},
    //     {lower: 20, change: +1},
    //     {lower: 30, change: +1},
    //     {lower: 40, change: +1},
    //     {lower: 50, change: +1},
    //     {lower: 60, change: +1},
    //     {lower: 70, change: +1},
    //     {lower: 80, change: +1},
    //     {lower: 90, change: +1},
    //     {lower: 100, change: +1},
    //   ],
    //   adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    // });


    // clientTable.addGlobalSecondaryIndex({
    //   indexName: 'IsUsed-index',
    //   partitionKey: {name: 'IsUsed', type: dynamodb.AttributeType.NUMBER},
    //   projectionType: dynamodb.ProjectionType.INCLUDE,
    //   nonKeyAttributes: ['S3BaseUri'],
    // });

    // const cloudFrontOAI = new cloudFront.OriginAccessIdentity(this, 'Allows CloudFront to reach the bucket',{
    //   comment: `${id}`
    // });

    // siteBucket.addToResourcePolicy(new iam.PolicyStatement({
    //   actions: ['s3:GetObject'],
    //   resources: [siteBucket.arnForObjects('*')],
    //   principals: [cloudFrontOAI.grantPrincipal],
    // }))

    // siteBucket.addToResourcePolicy(new iam.PolicyStatement({
    //   actions: ['s3:GetObject'],
    //   resources: [siteBucket.arnForObjects('*')],
    //   principals: [new iam.AnyPrincipal],
    //   conditions: {
    //     "IpAddress": {
    //       "aws:SourceIp": [
    //                     "211.21.98.205/32",
    //                     "118.167.158.212/32",
    //                     "118.163.21.229/32",
    //                     "114.35.123.16/32",
    //                     "52.25.99.0/32",
    //                     "60.250.137.11/32",
    //                     "59.124.14.121/32",
    //                     "36.230.77.121/32",
    //                   ]
    //     },
    //   }
    // }));

    // manageSiteBucket.addToResourcePolicy(new iam.PolicyStatement({
    //   actions: ['s3:GetObject'],
    //   resources: [manageSiteBucket.arnForObjects('*')],
    //   principals: [cloudFrontOAI.grantPrincipal],
    // }))

    // manageSiteBucket.addToResourcePolicy(new iam.PolicyStatement({
    //   actions: ['s3:GetObject'],
    //   resources: [manageSiteBucket.arnForObjects('*')],
    //   principals: [new iam.AnyPrincipal],
    //   conditions: {
    //     "IpAddress": {
    //       "aws:SourceIp": [
    //                     "211.21.98.205/32",
    //                     "118.167.158.212/32",
    //                     "118.163.21.229/32",
    //                     "114.35.123.16/32",
    //                     "52.25.99.0/32",
    //                     "60.250.137.11/32",
    //                     "59.124.14.121/32",
    //                     "36.230.77.121/32",
    //                   ]
    //     },
    //   }
    // }));

    // const cloudFrontRecord = new cloudFront.CloudFrontWebDistribution(this, domain, {
    //   viewerCertificate: cloudFront.ViewerCertificate.fromAcmCertificate(acm.Certificate.fromCertificateArn(this, 'Cert',
    //     certificateArn), {
    //     aliases: [domain],
    //     securityPolicy: cloudFront.SecurityPolicyProtocol.TLS_V1_2_2021,
    //   }),
    //   originConfigs: [{
    //     s3OriginSource: {
    //       s3BucketSource: siteBucket,
    //       originAccessIdentity: cloudFrontOAI,
    //     },
    //     behaviors: [{
    //       isDefaultBehavior: true,
    //       allowedMethods: cloudFront.CloudFrontAllowedMethods.ALL,
    //     }],
    //   }],
    //   errorConfigurations: [{errorCode: 403, responseCode: 200, responsePagePath: '/index.html', errorCachingMinTtl: 10,}],
    //   priceClass: cloudFront.PriceClass.PRICE_CLASS_200,
    // })

    // new ssm.StringParameter(this, 'ApiEndpoint', {
    //   allowedPattern: '.*',
    //   description: 'ApiEndpoint',
    //   parameterName: '/CryptoMate/ApiEndpoint',
    //   stringValue: `https://api.${domain}`,
    //   tier: ssm.ParameterTier.STANDARD,
    // });

    // new ssm.StringParameter(this, 'FrontendBaseUrl', {
    //   allowedPattern: '.*',
    //   description: 'FrontendBaseUrl',
    //   parameterName: '/CryptoMate/FrontendBaseUrl',
    //   stringValue: `https://${domain}`,
    //   tier: ssm.ParameterTier.STANDARD,
    // });

    // new ssm.StringParameter(this, 'ManageFrontendBaseUrl', {
    //   allowedPattern: '.*',
    //   description: 'ManageFrontendBaseUrl',
    //   parameterName: '/CryptoMate/ManageFrontendBaseUrl',
    //   stringValue: `https://${manageDomain}`,
    //   tier: ssm.ParameterTier.STANDARD,
    // });

    // new ssm.StringParameter(this, 'S3FrontendBucket', {
    //   allowedPattern: '.*',
    //   description: 'S3 Frontend Bucket Name',
    //   parameterName: '/CryptoMate/S3FrontendBucket',
    //   stringValue: siteBucket.bucketName,
    //   tier: ssm.ParameterTier.STANDARD,
    // });

    // new ssm.StringParameter(this, 'S3AssessmentsBucket', {
    //   allowedPattern: '.*',
    //   description: 'S3 Assessments Bucket Name',
    //   parameterName: '/CryptoMate/S3AssessmentsBucket',
    //   stringValue: assessmentsBucket.bucketName,
    //   tier: ssm.ParameterTier.STANDARD,
    // });

    new ssm.StringParameter(this, 'DynamoDBClientTableName', {
      allowedPattern: '.*',
      description: 'DynamoDB Client Table Name',
      parameterName: '/CryptoMate/DynamoDBClientTable',
      stringValue: clientTable.tableName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'SecurityGroupID', {
      allowedPattern: '.*',
      description: 'Security Group ID',
      parameterName: '/CryptoMate/SecurityGroupID',
      stringValue: securityGroup.securityGroupId,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSClusterName', {
      allowedPattern: '.*',
      description: 'ECS Cluster Name',
      parameterName: '/CryptoMate/ECSClusterName',
      stringValue: `${cluster.clusterName}:${cluster.clusterArn}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSTaskExecutionRole', {
      allowedPattern: '.*',
      description: 'ECS Task Execution Role',
      parameterName: '/CryptoMate/ECSTaskExecutionRole',
      stringValue: ecsTaskExecutionRole.roleName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSClientTask', {
      allowedPattern: '.*',
      description: 'ECS Client Task',
      parameterName: '/CryptoMate/ECSClientTask',
      stringValue: clientTaskDefinition.taskDefinitionArn,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSClientTestTask', {
      allowedPattern: '.*',
      description: 'ECS Client Test Task',
      parameterName: '/CryptoMate/ECSClientTestTask',
      stringValue: clientTestTaskDefinition.taskDefinitionArn,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSTradeWagonTask', {
      allowedPattern: '.*',
      description: 'ECS TradeWagon Task',
      parameterName: '/CryptoMate/ECSTradeWagonTask',
      stringValue: tradeWagonTaskDefinition.taskDefinitionArn,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSConsoleTask', {
      allowedPattern: '.*',
      description: 'ECS Console Task',
      parameterName: '/CryptoMate/ECSConsoleTask',
      stringValue: consoleTaskDefinition.taskDefinitionArn,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ECSClientCapacityProvider', {
      allowedPattern: '.*',
      description: 'ECS Client Task',
      parameterName: '/CryptoMate/ECSClientCapacityProvider',
      stringValue: clientCapacityProvider.capacityProviderName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'PublicSubnets', {
      allowedPattern: '.*',
      description: 'ECS Client Task',
      parameterName: '/CryptoMate/PublicSubnets',
      stringValue: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'PrivateSubnets', {
      allowedPattern: '.*',
      description: 'ECS Client Task',
      parameterName: '/CryptoMate/PrivateSubnets',
      stringValue: vpc.isolatedSubnets.map(subnet => subnet.subnetId).join(','),
      tier: ssm.ParameterTier.STANDARD,
    });

    // new ssm.StringParameter(this, 'CloudFrontDistDomainName', {
    //   allowedPattern: '.*',
    //   description: 'CloudFront Distribution Domain Name',
    //   parameterName: '/CryptoMate/CloudFrontDistributionName',
    //   stringValue: cloudFrontRecord.distributionDomainName,
    //   tier: ssm.ParameterTier.STANDARD,
    // });
  }
}
