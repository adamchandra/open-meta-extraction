#!/bin/sh


infile="$1"

RED='\033[0;41;30m'
STD='\033[0;0;39m'

pause(){
    read -p "Press [Enter] key to continue..." fackEnterKey
}

entry_okay(){
	  echo "everything is okay with $infile.entry.okay.gt"
    touch "$infile.entry_okay.gt"
    exit 0
}

host_okay(){
	  echo "everything is okay with $infile.host.okay.gt"
    touch "$infile.host_okay.gt"
    exit 0
}

host_path_okay(){
	  echo "everything is okay with $infile.host_path.okay.gt"
    touch "$infile.host_path_okay.gt"
    exit 0
}

bury_host(){
	  echo "skip $infile"
    touch "$infile.bury_host.gt"
    exit 0
}

skip(){
	  echo "skipping"
    exit 0
}

show_menus() {
	  echo "~~~~~~~~~~~~~~~~~~~~~"
	  echo " Assert Ground Truth "
	  echo "~~~~~~~~~~~~~~~~~~~~~"
	  echo "1. Host Okay"
	  echo "2. Host/Path Okay"
	  echo "3. Entry Okay"
	  echo "4. Bury Host"
	  echo "5. Skip"
}

read_options(){
	  local choice
	  read -p "choice> [1 ... 3] " choice
	  case $choice in
		    1) host_okay ;;
		    2) host_path_okay ;;
		    3) entry_okay ;;
		    4) bury_host ;;
		    5) skip ;;
	  esac
}

while true
do
	  show_menus
	  read_options
done
