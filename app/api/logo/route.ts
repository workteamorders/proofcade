/** Whether custom logos are switched on (a Vercel Blob store is connected). The launch page uses this to show or hide the upload. */
export async function GET() {
  return Response.json({ enabled: !!process.env.BLOB_READ_WRITE_TOKEN }, { headers: { 'cache-control': 'no-store' } });
}
