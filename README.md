Create templates manually or from the context menu in Explorer.

You can create and use:

    - Template files.
    The template file name is the extension of the final file. 
        /* For example, for the file "Name.module.scss", the template file name should be "module.scss". */
    All created template files are stored in the directory of this extension in the ".vscode/templateFiles" directory in ".txt" format.
    In the files you can define external variables:
        {fileName} - file name

    - Template components. 
    Template components group template files. The components are created in the directory of this extension (in the file ".vscode/templateFiles/config.json").

MORE ABOUT COMPONENTS:

The idea behind the companion structure can be described as follows:
All existing template components are defined at the first level of nesting config.json:
    /* For example
    {
        { "kit": [],
        "ui": []
    } 
    kit and ui templates */

They can contain template files and components (which are at the first nesting level) inside them.

WARNING: It is forbidden to create a companion structure with nesting level greater than 8!

Components are initially just a structure for grouping files:
    /* For example "reactComponent": ["tsx", "module.scss"] groups the "tsx" and "module.scss" files together */

Eventually the files will not be grouped in the same directory.
    /* For example a structure of 
    {
        "small": ["tsx", "module.scss"],
        "large": [ "small", "js", "jsx"]
    }
    will simply create a list of files from "tsx", "module.scss", "small", "js", "jsx" */

The following structure is used to create the directory where the files will be stored:
    /* For example a structure of 
    {
        "small": ["tsx", "module.scss"],
        "large": [
            {
                }, "smallDir": [ "small"]
            }, 
            { "js",
            "jsx"
        ]
    }
    will create a directory named smallDir, which will contain the contents of the small component */


NOTE* when creating a component, rather than just a file, a root directory is created with the name of the component (which is entered by the user at creation),
This is essentially the same as if config.json looked like this:
    /* 
    {
        "small": ["tsx", "module.scss"],
        "large": [
                {
                    }, "smallDir": [ "small"]
                }, 
                { "js",
                "jsx"
        ],
        "enteredName": [
            { "small",
            "large",
        ]
    }
    */
but, at the first level of nesting, only the components should be defined, so the directory-defining rule works without affecting the first level