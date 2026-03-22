import allInline from 'all-inline';
import React, { RefObject, useLayoutEffect, useRef } from 'react';
import { useService } from '../hooks/useService';
import PackageService from '../services/Package.service';

async function generateWidgetHTML(
  packageService: PackageService,
  packageCid: string
): Promise<string> {
  const html = await packageService.getAssetAsText(packageCid, 'index.html');
  const doc = new DOMParser().parseFromString(html, 'text/html');

  await allInline(
    doc,
    async (filename: string, encoding: 'data-uri' | 'text') => {
      filename = filename.replace(/^.\//, '');
      return encoding === 'data-uri'
        ? packageService.getAssetAsDataUri(packageCid, filename)
        : packageService.getAssetAsText(packageCid, filename);
    }
  );

  return doc.documentElement.outerHTML;
}

export interface OwnableFrameProps {
  id: string;                 // stable per ownable
  packageCid: string;         // read only at mount
  isDynamic: boolean;         // read only at mount
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLoad: () => void;         // can be stable or not, does not trigger re-render
}

function OwnableFrameInner(props: OwnableFrameProps) {
  const packages = useService('packages');

  // Freeze initial values so later prop changes are ignored
  const init = useRef({
    packageCid: props.packageCid,
  });

  // Set srcdoc exactly once on mount
  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      if (!packages || !props.iframeRef.current) return;
      const html = await generateWidgetHTML(packages, init.current.packageCid);
      if (!cancelled && props.iframeRef.current) {
        props.iframeRef.current.srcdoc = html;
      }
    })();
    return () => {
      cancelled = true;
    };
    // empty deps, intentional one-time init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages]);

  return (
    <iframe
      id={props.id}
      title={`Ownable ${props.id}`}
      ref={props.iframeRef}
      sandbox="allow-scripts"
      onLoad={props.onLoad}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        border: 'none',
      }}
    />
  );
}

// Never re-render after first mount for a given id.
// If you need a fresh frame, change the React key or the id.
const OwnableFrame = React.memo(OwnableFrameInner, (prev, next) => prev.id === next.id);

export default OwnableFrame;
