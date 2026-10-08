"use client";
import { useLayoutEffect, useState } from "react";
import { BookingRequests } from "../../lib/booking-requests";

export function useBookingRequests(enabled = true) {
  const [requests] = useState(() => new BookingRequests());
  useLayoutEffect(() => {
    if (enabled) requests.start();
    return () => requests.stop();
  }, [enabled, requests]);
  return requests;
}
