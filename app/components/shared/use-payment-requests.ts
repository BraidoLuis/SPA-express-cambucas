"use client";

import { useLayoutEffect, useState } from "react";
import { PaymentRequests } from "../../lib/payment-requests";

export function usePaymentRequests() {
  const [requests] = useState(() => new PaymentRequests());
  useLayoutEffect(() => {
    requests.activate();
    return () => requests.deactivate();
  }, [requests]);
  return requests;
}
