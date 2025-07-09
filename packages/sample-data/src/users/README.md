1. Create a did for the persona `node ../../../../tools/verifgen did -p vanessa-lin`
2. From each json generate a VC for it `node ../../../../tools/verifgen credential ./vanessa-lin-email.json -t Email -s -i vanessa-lin -o vanessa-lin-email`
or  `node ../../../../tools/verifgen credential ./vanessa-lin-phone.json -t Phone -s -i vanessa-lin -o vanessa-lin-phone`
   
The recipe is `node ../../../../tools/verifgen credential <JSON FILE> -t <CREDENTIAL TYPE> -s -i <PERSONA DID> -o <OUTPUT_FILE_NAME>`