#!/bin/bash
#
# 

create_key(){
	mkdir -p /ddns/key
	rm -f /ddns/key/Kddns_update*
	
	local cms=($(dnssec-keygen -K key/ -a HMAC-MD5 -b 128 -r /dev/urandom -n USER DDNS_UPDATE))
	KEY=$(cat /ddns/key/Kddns_update*.private | grep Key | cut -d " " -f 2)

	echo "key \"DDNS_UPDATE\" {
		algorithm hmac-md5;
		secret \"$KEY\";
	};" >> /etc/bind/named.conf.local

}

read_config(){
	local  CONFIGFILE="$1"

	NAMESERVER=$(cat $CONFIGFILE | grep NAMESERVER | cut -d " " -f 2)
	DYNAMIC_DOMAIN=$(cat $CONFIGFILE | grep DYNAMIC_DOMAIN | cut -d " " -f 2)
	local my_list=("$NAMESERVER" "$DYNAMIC_DOMAIN")  
	echo "${my_list[@]}" 
}

create_zones(){	

	for filename in /ddns/config/*; do
    	#echo "$filename"
    	read_config $filename
		local result=( $(read_config $filename))

		echo "${result[0]} ${result[1]}" 
	done

}

rm -f /etc/bind/named.conf.local

touch /etc/bind/named.conf.local

echo "// generated by samisdat/ddns" > /etc/bind/named.conf.local


create_key
create_zones