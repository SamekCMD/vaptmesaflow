// The scheduled and Queue handlers are added in Tasks 5 and 6. Fail closed until then.
export default {
  scheduled(): never {
    throw new Error('Billing email dispatcher is not configured');
  },
  queue(): never {
    throw new Error('Billing email consumer is not configured');
  },
};
