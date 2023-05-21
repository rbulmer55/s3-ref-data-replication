import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

interface CustomProps extends cdk.StackProps {
	destinationBuckets: s3.IBucket[];
}

export class StatefulS3ReplicationDataStackServiceA extends cdk.Stack {
	public readonly uploadBucket: s3.Bucket;
	public readonly masterBucket: s3.Bucket;

	constructor(scope: Construct, id: string, props?: CustomProps) {
		super(scope, id, props);

		if (!props?.destinationBuckets.length) {
			throw new Error('No replication buckets found.');
		}

		const replicationBuckets = props.destinationBuckets;

		const uploadBucket = new s3.Bucket(this, 'upload-bucket', {
			objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: RemovalPolicy.DESTROY,
		});
		this.uploadBucket = uploadBucket;

		const masterBucket = new s3.Bucket(this, 'master-bucket', {
			objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			versioned: true,
			removalPolicy: RemovalPolicy.DESTROY,
		});
		this.masterBucket = masterBucket;

		const replicationRole = new iam.Role(this, 'replication-role', {
			assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
			path: '/service-role/',
			description: 'IAM service role for s3 replication',
		});

		replicationRole.addToPolicy(
			new iam.PolicyStatement({
				resources: [masterBucket.bucketArn],
				actions: ['s3:GetReplicationConfiguration', 's3:ListBucket'],
			})
		);

		replicationRole.addToPolicy(
			new iam.PolicyStatement({
				resources: [masterBucket.arnForObjects('*')],
				actions: [
					's3:GetObjectVersion',
					's3:GetObjectVersionAcl',
					's3:GetObjectVersionForReplication',
					's3:GetObjectLegalHold',
					's3:GetObjectVersionTagging',
					's3:GetObjectRetention',
				],
			})
		);

		replicationBuckets.forEach((destinationBucket) => {
			replicationRole.addToPolicy(
				new iam.PolicyStatement({
					resources: [destinationBucket.arnForObjects('*')],
					actions: [
						's3:ReplicateObject',
						's3:ReplicateDelete',
						's3:ReplicateTags',
						's3:GetObjectVersionTagging',
						's3:ObjectOwnerOverrideToBucketOwner',
					],
				})
			);
		});

		const replicationConfiguration: s3.CfnBucket.ReplicationConfigurationProperty =
			{
				role: replicationRole.roleArn,
				rules: replicationBuckets.map(
					(destinationBucket, index): s3.CfnBucket.ReplicationRuleProperty => {
						return {
							destination: {
								bucket: destinationBucket.bucketArn,
								/**
								 * Cross-Account Settings
								 * account: 'account-id',
								 * accessControlTranslation: { owner: 'account-name' },
								 */
							},
							status: 'Enabled',
							priority: index + 1,
							filter: {
								prefix: '',
							},
							deleteMarkerReplication: {
								status: 'Enabled',
							},
						};
					}
				),
			};
		const cfnMasterBucket = masterBucket.node.defaultChild as s3.CfnBucket;
		cfnMasterBucket.replicationConfiguration = replicationConfiguration;
	}
}
