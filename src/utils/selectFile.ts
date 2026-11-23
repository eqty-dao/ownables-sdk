interface SelectFileProps {
  accept?: string,
  multiple?: boolean,
}

export default async function selectFile(props: SelectFileProps = {}): Promise<FileList> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = props.accept || '';
    input.multiple = !!props.multiple;

    input.onchange = () => resolve(input.files ?? new DataTransfer().files);
    input.oncancel = () => resolve(new DataTransfer().files);
    input.onerror = () => reject("Error selecting files");
    input.click();
  });
}
