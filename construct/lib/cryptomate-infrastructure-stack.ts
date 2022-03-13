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

import { Stack, StackProps, RemovalPolicy, aws_certificatemanager, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { VpcEndpointServiceDomainName } from 'aws-cdk-lib/aws-route53';
import { CfnDisk } from 'aws-cdk-lib/aws-lightsail';
export class CryptomateInfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // const certificateArn = 'arn:aws:acm:us-east-1:172755610134:certificate/37a43c92-3cee-49fc-b5d1-cf4e0e6a3b19';
    // const domain = 'dev.cryptomate.yunn.tw';
    // const manageDomain = 'manage.dev.cryptomate.yunn.tw';
    // const assessmentsDomain = 'assessments.dev.cryptomate.yunn.tw'
    // const domainPrefix = 'cryptomate'
    // const manageDomainPrefix = 'manage-dev-cryptomate'
    // const region = 'us-west-2'

    const domain = 'cryptomate.yunn.tw';
    const manageDomain = 'manage.cryptomate.yunn.tw';
    const assessmentsDomain = 'assessments.cryptomate.yunn.tw'
    const domainPrefix = 'cryptomate'
    const manageDomainPrefix = 'manage-cryptomate'
    const region = 'ap-northeast-1'
    
    const siteBucket = new Bucket(this, 'siteBucket', {
      bucketName: domain,
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const manageSiteBucket = new Bucket(this, 'manageSiteBucket', {
      bucketName: manageDomain,
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

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
      ], // Managed policy for ECS Task Execution Role
    });

    const vpc = new ec2.Vpc(this, "EcsVpc", {
      vpcName: 'ecs_vpc',
      cidr: '10.100.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration:[{
        name: "Public Subnet 1",
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
        mapPublicIpOnLaunch: true,
      },{
        name: "Public Subnet 2",
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
        mapPublicIpOnLaunch: true
      },{
        name: "Private Subnet 1",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 24,
      },{
        name: "Private Subnet 2",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 24,
      }],
    })

    const securityGroup = new SecurityGroup(this, 'ECS_SG', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Allow Container Outbound Traffic', 
    })
    securityGroup.addIngressRule(securityGroup, ec2.Port.allTraffic())

    // securityGroup.addIngressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(80))

    const cluster = new ecs.Cluster(this, "Cluster1", {
      vpc: vpc,
      containerInsights: true,
      clusterName: 'MainCluster',
    });

    const ecrRepoClient = new ecr.Repository(this, 'ecrRepoClient', {
      repositoryName: 'cryptomate-client',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const ecrRepoServer = new ecr.Repository(this, 'ecrRepoServer', {
      repositoryName: 'cryptomate-server',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const ecrRepoAPI = new ecr.Repository(this, 'ecrRepoAPI', {
      repositoryName: 'cryptomate-api',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      minCapacity: 0,
      maxCapacity: 2,
      desiredCapacity: 0,
      securityGroup: securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });
    
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    const clientTable = new dynamodb.Table(this, 'ClientTable', {
      tableName: 'CryptoMate_Contract',
      partitionKey: { name: 'ContractID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    clientTable.addGlobalSecondaryIndex({
      indexName: 'IsUsed-index',
      partitionKey: {name: 'IsUsed', type: dynamodb.AttributeType.NUMBER},
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['S3BaseUri'],
    });

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

    new ssm.StringParameter(this, 'ApiEndpoint', {
      allowedPattern: '.*',
      description: 'ApiEndpoint',
      parameterName: '/CryptoMate/ApiEndpoint',
      stringValue: `https://api.${domain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'FrontendBaseUrl', {
      allowedPattern: '.*',
      description: 'FrontendBaseUrl',
      parameterName: '/CryptoMate/FrontendBaseUrl',
      stringValue: `https://${domain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ManageFrontendBaseUrl', {
      allowedPattern: '.*',
      description: 'ManageFrontendBaseUrl',
      parameterName: '/CryptoMate/ManageFrontendBaseUrl',
      stringValue: `https://${manageDomain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'S3FrontendBucket', {
      allowedPattern: '.*',
      description: 'S3 Frontend Bucket Name',
      parameterName: '/CryptoMate/S3FrontendBucket',
      stringValue: siteBucket.bucketName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'S3AssessmentsBucket', {
      allowedPattern: '.*',
      description: 'S3 Assessments Bucket Name',
      parameterName: '/CryptoMate/S3AssessmentsBucket',
      stringValue: assessmentsBucket.bucketName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'DynamoDBClientTableName', {
      allowedPattern: '.*',
      description: 'DynamoDB Client Table Name',
      parameterName: '/CryptoMate/DynamoDBClientTable',
      stringValue: clientTable.tableName,
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'PublicSubnetID', {
      allowedPattern: '.*',
      description: 'Public Subnet ID',
      parameterName: '/CryptoMate/PublicSubnetID',
      stringValue: vpc.publicSubnets[0].subnetId,
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

    // new ssm.StringParameter(this, 'CloudFrontDistDomainName', {
    //   allowedPattern: '.*',
    //   description: 'CloudFront Distribution Domain Name',
    //   parameterName: '/CryptoMate/CloudFrontDistributionName',
    //   stringValue: cloudFrontRecord.distributionDomainName,
    //   tier: ssm.ParameterTier.STANDARD,
    // });
  }
}