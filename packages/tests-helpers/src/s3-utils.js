const {
  ListObjectsCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');

const deleteS3Object = async (s3Client, bucketName) => {
  const data = await s3Client.send(
    new ListObjectsCommand({ Bucket: bucketName })
  );

  // Check if data.Contents exists and is not empty
  if (data.Contents && data.Contents.length > 0) {
    const objects = data.Contents.map(({ Key }) => ({ Key }));
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects },
      })
    );
  }
};

const getObject = async ({ s3Client, bucket, key }) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    return await s3Client.send(new GetObjectCommand(params));
  } catch (e) {
    return null;
  }
};

module.exports = {
  deleteS3Object,
  getObject,
};
