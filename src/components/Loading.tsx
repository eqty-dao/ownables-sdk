import { Backdrop } from "@/components/ui";
import React from "react";
import { LoaderCircle } from "lucide-react"

export default function Loading(props: {show: boolean}) {
  return <Backdrop open={props.show} style={{ zIndex: 1400 }}>
    <LoaderCircle className="animate-spin" size={80} />
  </Backdrop>
}
