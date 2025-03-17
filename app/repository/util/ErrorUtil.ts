export function isDuplicateKeyError(err: Error) {
  // @ts-expect-error error code is not defined
  if (err.code === 'ER_DUP_ENTRY') {
    return true;
  }
  if (err.message.includes('duplicate key value violates unique constraint')) {
    // pg: duplicate key value violates unique constraint "tasks_uk_task_id"
    // code: '23505'
    return true;
  }
}
