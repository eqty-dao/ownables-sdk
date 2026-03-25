import {Backdrop, CircularProgress} from "@/components/ui";
import React from "react";

export default function Loading(props: {show: boolean}) {
  return <Backdrop open={props.show} style={{ zIndex: 1400 }}>
    <CircularProgress size={80} />
  </Backdrop>
}
