import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('file-templates.createNewFile', async (args) => {
		const templateDir = path.join(context.extensionPath, 'out', 'templateFiles');

		const fileItems = fs.readdirSync(templateDir)
			.filter(file => path.parse(file).ext === '.txt')
			.map(file => path.basename(file, '.txt'));
		type Content = Array<string | ComponentsOrFiles>;
		type ComponentsOrFiles = Record<'string', Content>;
		const pathToConfig = path.join(templateDir, 'config.json');
		const config = JSON.parse(fs.readFileSync(pathToConfig, 'utf8')) as ComponentsOrFiles;
		const componentItems = Object.keys(config);

		const selectedItem = await vscode.window.showQuickPick(['Create Template', ...fileItems, ...componentItems]);
		if (!selectedItem) { return; }

		if (selectedItem === 'Create Template') {
			const nameTemplate = await vscode.window.showInputBox({ prompt: 'Enter the type for template. Example: tsx, module.scss, jsx' });
			if (!nameTemplate) { return; }

			const fileName = `${nameTemplate}.txt`;
			const fileUri = vscode.Uri.file(path.join(templateDir, fileName));
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(''));

			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);

		}
		const workspaceFolder = args?.fsPath ? vscode.Uri.file(args.fsPath) : undefined;;
		if (!workspaceFolder) { return; }

		const elementName = await vscode.window.showInputBox({ prompt: 'Enter the name of the new component' });
		if (!elementName) { return; }

		const createFile = async (templateName: string, destination: string[] = []) => {
			const destinationUri = vscode.Uri.joinPath(workspaceFolder, ...destination, `${elementName}.${templateName}`);
			console.log('destinationUri', destinationUri);
			const templateUri = vscode.Uri.file(path.join(templateDir, `${templateName}.txt`));
			const templateContent = await vscode.workspace.fs.readFile(templateUri);
			const templateText = new TextDecoder().decode(templateContent);
			const replacedText = templateText.replace(/{fileName}/g, elementName);

			await vscode.workspace.fs.writeFile(destinationUri, Buffer.from(replacedText));
		};

		const createDir = (folderPath: string[]) => {
			const newFolderPath = path.join(workspaceFolder.fsPath || '', ...folderPath);
			fs.mkdirSync(newFolderPath, { recursive: true });
		};
		// File its template file, component its multiply template files (with dir or no)
		const createFileOrComponent = async (componentOrFileName: string, [...folderPath]: string[] = [], nestingLevel = 1) => {
			if (nestingLevel >= 8) {
				return;
			}
			if (fileItems.includes(componentOrFileName)) {
				await createFile(componentOrFileName, [...folderPath]);
			} else if (componentItems.includes(selectedItem)) {
				const componentName = componentOrFileName;
				const createComponentOrDir = async (componentItems: Content, folderPath: string[]) => {
					for (const componentItem of componentItems) {
						if (typeof componentItem === 'string') {
							await createFileOrComponent(componentItem, [...folderPath], nestingLevel + 1);
						} else {
							//  if componentItem has {"..": [...]} structure its must create dir
							for (const [dirName, dirItems] of Object.entries(componentItem)) {
								createDir([...folderPath, dirName]);
								await createComponentOrDir(dirItems, [...folderPath, dirName]);
							}
						}
					}
				};
				// @ts-ignore
				createComponentOrDir(config[componentName] as Content, folderPath);
			}
		};

		const folderPath = [];
		// create root if creating component
		if (componentItems.includes(selectedItem)) {
			const newFolderPath = path.join(workspaceFolder.fsPath || '', elementName);
			fs.mkdirSync(newFolderPath, { recursive: true });
			folderPath.push(elementName);
		}

		await createFileOrComponent(selectedItem, folderPath);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }