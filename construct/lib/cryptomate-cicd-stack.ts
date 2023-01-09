import * as iam from 'aws-cdk-lib/aws-iam';
import * as codePipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as codeBuild from 'aws-cdk-lib/aws-codebuild';

import { Stack, StackProps, RemovalPolicy, aws_certificatemanager, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { VpcEndpointServiceDomainName } from 'aws-cdk-lib/aws-route53';
import { CfnDisk } from 'aws-cdk-lib/aws-lightsail';
export class CryptomateCICDStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const region = 'us-west-2'

    const codeBuildRole = new iam.Role(this, 'codeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    })

    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['s3:PutObject',
                's3:GetObject',
                's3:ListBucket',
                's3:GetBucketAcl',
                's3:DeleteObject',
                's3:GetBucketLocation',
                's3:GetObjectVersion',
                'logs:CreateLogGroup',
                'logs:PutLogEvents',
                'logs:CreateLogStream',]
    }))

    const project = new codeBuild.PipelineProject(this, 'Project', {
      buildSpec: codeBuild.BuildSpec.fromSourceFilename('buildspec/buildspec-dev.yml'),
      projectName: id,
      environment: {
        computeType: codeBuild.ComputeType.SMALL,
        // buildImage: codeBuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/amazonlinux2-aarch64-standard:2.0'),
      },
      role: codeBuildRole,
    });
    // (project.node.defaultChild as codeBuild.CfnProject).addOverride('Properties.Environment.Type','ARM_CONTAINER');

    const sourceOutput = new codePipeline.Artifact();
    const sourceAction = new codePipelineActions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: codeCommit.Repository.fromRepositoryArn(this, 'repo', 'arn:aws:codecommit:us-west-2:784405092080:CryptoMate-Server'),
      output: sourceOutput,
      branch: 'dev',
    });

    const buildAction = new codePipelineActions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
    });

    new codePipeline.Pipeline(this, 'Pipeline', {
      artifactBucket: Bucket.fromBucketName(this, 'PielineBuckt', assessmentsDomain),
      stages: [{
         stageName: 'Source',
          actions: [sourceAction],
        },{
          stageName: 'Build',
          actions: [buildAction],
        }
      ],
      pipelineName: id,
    });
  }
}
